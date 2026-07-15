// B5: gate the ENTIRE file on the http feature so plain `cargo nextest run
// -p testkit` (including the nightly soak job) compiles it to nothing and does
// not need ureq. It runs only under `--features http`.
#![cfg(feature = "http")]
//! HttpEnv is exercised end-to-end against the real serve() in
//! game/tests/agent_http.rs. Here we only check HttpEnv's JSON mapping against
//! a hand-rolled tiny_http... but testkit has no tiny_http dep, so instead we
//! test the pure request/response mapping via a std::net TcpListener stub.
use std::io::{Read, Write};
use std::net::TcpListener;
use testkit::env::AgentEnv;
use testkit::http_env::HttpEnv;

fn stub_server(response_body: &'static str) -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for stream in listener.incoming().take(1) {
            let mut s = stream.unwrap();
            let mut buf = [0u8; 1024];
            let _ = s.read(&mut buf);
            let resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                response_body.len(), response_body
            );
            let _ = s.write_all(resp.as_bytes());
        }
    });
    port
}

#[test]
fn http_env_observe_parses_state() {
    let body = r#"{"observation":{"player":null,"catalog":[],"opponents":[],"leaderboard":[],"history":[],"status":"ok","status_is_error":false,"screen":"Login"},"ui":{"screen":"Login","selected_opponent":null,"fleet_travel":null,"battle_animating":false,"battle_finished":false}}"#;
    let port = stub_server(body);
    let mut env = HttpEnv::new(format!("http://127.0.0.1:{port}"));
    let obs = env.observe().unwrap();
    assert_eq!(obs.status, "ok");
    assert_eq!(obs.screen.as_deref(), Some("Login"));
}
