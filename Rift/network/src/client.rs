//! Blocking request/response client. Speaks the same length-prefixed framing
//! over either a direct TCP socket or a WebSocket relay (e.g. recurse.click).

use crate::protocol::{Request, Response};
use crate::wire::{read_msg, write_msg};
use std::io::{self, BufReader, BufWriter};
use std::net::TcpStream;
use std::time::Duration;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::WebSocket;

enum Transport {
    Tcp {
        reader: BufReader<TcpStream>,
        writer: BufWriter<TcpStream>,
    },
    Ws {
        socket: WebSocket<MaybeTlsStream<TcpStream>>,
        buf: Vec<u8>,
    },
}

/// A connection to a Rift server.
pub struct Client {
    transport: Transport,
}

impl Client {
    /// Connect to `addr`. `ws://`/`wss://` use a WebSocket relay; anything else
    /// is treated as a `host:port` TCP address.
    pub fn connect(addr: &str) -> Result<Self, String> {
        if addr.starts_with("ws://") || addr.starts_with("wss://") {
            Self::connect_ws(addr)
        } else {
            Self::connect_tcp(addr)
        }
    }

    fn connect_tcp(addr: &str) -> Result<Self, String> {
        let stream = TcpStream::connect(addr).map_err(|e| format!("connect to {}: {}", addr, e))?;
        stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
        let reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
        let writer = BufWriter::new(stream);
        Ok(Client { transport: Transport::Tcp { reader, writer } })
    }

    fn connect_ws(addr: &str) -> Result<Self, String> {
        let (socket, _) = tungstenite::connect(addr).map_err(|e| format!("ws connect {}: {}", addr, e))?;
        Ok(Client { transport: Transport::Ws { socket, buf: Vec::new() } })
    }

    /// Send a request and block for the matching response.
    pub fn call(&mut self, request: Request) -> Result<Response, String> {
        match &mut self.transport {
            Transport::Tcp { reader, writer } => {
                write_msg(writer, &request).map_err(|e| e.to_string())?;
                read_msg::<_, Response>(reader).map_err(|e| e.to_string())
            }
            Transport::Ws { socket, buf } => {
                send_ws(socket, &request).map_err(|e| e.to_string())?;
                recv_ws(socket, buf).map_err(|e| e.to_string())
            }
        }
    }
}

fn send_ws<S: io::Read + io::Write>(
    socket: &mut WebSocket<S>,
    msg: &impl serde::Serialize,
) -> io::Result<()> {
    let payload = bincode::serialize(msg).map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    let mut frame = Vec::with_capacity(4 + payload.len());
    frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    frame.extend_from_slice(&payload);
    socket
        .send(tungstenite::Message::Binary(frame.into()))
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
}

/// Read one complete length-prefixed message from the relay, which may split or
/// coalesce frames, so we accumulate bytes in `buf`.
fn recv_ws<S: io::Read + io::Write>(
    socket: &mut WebSocket<S>,
    buf: &mut Vec<u8>,
) -> io::Result<Response> {
    loop {
        if buf.len() >= 4 {
            let len = u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize;
            if buf.len() >= 4 + len {
                let payload: Vec<u8> = buf[4..4 + len].to_vec();
                buf.drain(..4 + len);
                return bincode::deserialize(&payload)
                    .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()));
            }
        }
        match socket.read() {
            Ok(tungstenite::Message::Binary(data)) => buf.extend_from_slice(&data),
            Ok(tungstenite::Message::Ping(p)) => {
                let _ = socket.send(tungstenite::Message::Pong(p));
            }
            Ok(tungstenite::Message::Close(_)) => {
                return Err(io::Error::new(io::ErrorKind::ConnectionReset, "server closed connection"));
            }
            Ok(_) => {}
            Err(e) => return Err(io::Error::new(io::ErrorKind::Other, e.to_string())),
        }
    }
}
