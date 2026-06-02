//! Shopping List consolidation slice.
//!
//! Provides:
//! - Exact-merge algorithm (`exact_merge`)  
//! - OpenRouter AI polish (`call_openrouter_polish`)  
//! - Consolidation orchestration (`consolidate_shopping_list`)  
//! - CRUD for the **Saved Consolidated Shopping List** SQLite column  
//! - Axum handlers for all three route groups

pub mod application;
pub mod consolidation;
pub mod exact_merge;
pub mod handlers;
pub mod infrastructure;
pub mod internal;
pub mod models;
pub mod openrouter;
pub mod ports;
pub mod repository;
