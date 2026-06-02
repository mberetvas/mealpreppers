pub mod consolidate_shopping_list;
pub mod get_consolidated_shopping_list;
pub mod save_consolidated_shopping_list;

pub use consolidate_shopping_list::execute as consolidate_shopping_list;
pub use get_consolidated_shopping_list::execute as get_consolidated_shopping_list;
pub use save_consolidated_shopping_list::execute as save_consolidated_shopping_list;
