//! Planning read port for shopping-list consolidation (implemented by the Planning slice).

use crate::shadow_server::{planning::models::WeekPlanV1, platform::RepoError};

/// Weekplan body and fingerprint required to consolidate a shopping list.
pub struct WeekplanForConsolidation {
    pub body: WeekPlanV1,
    pub source_fingerprint: String,
}

/// Loads a principal-scoped weekplan for consolidation POST.
pub trait WeekplanForConsolidationReader: Send + Sync {
    fn get_for_consolidation(
        &self,
        plan_id: &str,
        user_id: &str,
    ) -> Result<WeekplanForConsolidation, RepoError>;
}
