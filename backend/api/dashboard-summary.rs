#[path = "../src/main.rs"]
mod backend_core;

use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

async fn handler(req: Request) -> Result<Response<Body>, Error> {
    respond(backend_core::handle_api_request(
        req.method().as_str(),
        "/api/dashboard-summary",
    ))
}

fn respond(api_response: backend_core::ApiResponse) -> Result<Response<Body>, Error> {
    let status =
        StatusCode::from_u16(api_response.status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "content-type")
        .header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        .body(Body::Text(api_response.body))?)
}
