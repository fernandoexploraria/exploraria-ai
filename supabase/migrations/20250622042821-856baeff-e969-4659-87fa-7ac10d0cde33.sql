
-- Add specific columns for each evaluation criterion, points of interest array, and analysis results
ALTER TABLE public.interactions 
ADD COLUMN call_status TEXT,
ADD COLUMN start_time BIGINT,
ADD COLUMN end_time BIGINT,
ADD COLUMN data_collection JSONB,
ADD COLUMN analysis_results JSONB,
ADD COLUMN points_of_interest_mentioned TEXT[],
ADD COLUMN info_accuracy_status TEXT,
ADD COLUMN info_accuracy_explanation TEXT,
ADD COLUMN navigation_effectiveness_status TEXT,
ADD COLUMN navigation_effectiveness_explanation TEXT,
ADD COLUMN engagement_interactivity_status TEXT,
ADD COLUMN engagement_interactivity_explanation TEXT,
ADD COLUMN problem_resolution_status TEXT,
ADD COLUMN problem_resolution_explanation TEXT,
ADD COLUMN efficiency_conciseness_status TEXT,
ADD COLUMN efficiency_conciseness_explanation TEXT,
ADD COLUMN user_satisfaction_status TEXT,
ADD COLUMN user_satisfaction_explanation TEXT;

-- Add indexes for better query performance
CREATE INDEX idx_interactions_call_status ON public.interactions (call_status);
CREATE INDEX idx_interactions_points_of_interest ON public.interactions USING gin(points_of_interest_mentioned);
CREATE INDEX idx_interactions_info_accuracy_status ON public.interactions (info_accuracy_status);
CREATE INDEX idx_interactions_navigation_effectiveness_status ON public.interactions (navigation_effectiveness_status);
CREATE INDEX idx_interactions_engagement_interactivity_status ON public.interactions (engagement_interactivity_status);
CREATE INDEX idx_interactions_problem_resolution_status ON public.interactions (problem_resolution_status);
CREATE INDEX idx_interactions_efficiency_conciseness_status ON public.interactions (efficiency_conciseness_status);
CREATE INDEX idx_interactions_user_satisfaction_status ON public.interactions (user_satisfaction_status);

-- Add indexes for JSON searches
CREATE INDEX idx_interactions_data_collection ON public.interactions USING gin(data_collection);
CREATE INDEX idx_interactions_analysis_results ON public.interactions USING gin(analysis_results);
