//! Recipe Ingestion slice — recipe URL preview pipeline.
//!
//! Ports the Node.js `recipe-ingestion` service to Rust:
//! - Validates the URL is a supported Belgian recipe host.
//! - Fetches HTML with browser-like headers.
//! - Detects publisher auth walls.
//! - Parses recipe data using JSON-LD (all sites) or HTML microdata (15gram.be).

pub mod fetch;
pub mod handlers;
pub mod models;
pub mod normalizers;
pub mod scraper;
pub mod sites;
