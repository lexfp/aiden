//! Length-prefixed bincode framing shared by the TCP and WebSocket transports.

use std::io::{self, Read, Write};

/// Serialize `msg` and write it as a 4-byte little-endian length prefix
/// followed by the payload.
pub fn write_msg<W: Write, T: serde::Serialize>(writer: &mut W, msg: &T) -> io::Result<()> {
    let data = bincode::serialize(msg).map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    let len = (data.len() as u32).to_le_bytes();
    writer.write_all(&len)?;
    writer.write_all(&data)?;
    writer.flush()
}

/// Read one length-prefixed, bincode-encoded message.
pub fn read_msg<R: Read, T: for<'de> serde::Deserialize<'de>>(reader: &mut R) -> io::Result<T> {
    let mut len_bytes = [0u8; 4];
    reader.read_exact(&mut len_bytes)?;
    let len = u32::from_le_bytes(len_bytes) as usize;
    let mut data = vec![0u8; len];
    reader.read_exact(&mut data)?;
    bincode::deserialize(&data).map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
}
