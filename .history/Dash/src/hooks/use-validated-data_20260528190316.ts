/**
 * Hook to filter and validate jobs/applications before display.
 * Prevents raw/unformatted data from being shown to users.
 */

import { useMemo } from "react";
import { validateJobData, validateApplicationData } from "@/lib/data-validation";

/**
 * Hook to filter jobs and remove those with invalid/raw data
 */
export function useValidatedJobs(jobs: any[] | undefined) {
  return useMemo(() => {
    if (!jobs) return [];
    
    return jobs.filter((job) => {
      const validation = validateJobData({
        title: job.title,
        company: job.company,
        description: job.description,
        role_description: job.role_description,
        location: job.location,
        match_score: job.match_score,
        salary_text: job.salary_text,
        job_type: job.job_type,
      });

      if (!validation.valid) {
        console.warn(`[Data Validation] Filtering out job with errors:`, {
          jobId: job.id,
          title: job.title,
          errors: validation.errors,
        });
      }

      return validation.valid;
    });
  }, [jobs]);
}

/**
 * Hook to filter applications and remove those with invalid/raw data
 */
export function useValidatedApplications(applications: any[] | undefined) {
  return useMemo(() => {
    if (!applications) return [];

    return applications.filter((app) => {
      const validation = validateApplicationData({
        job_title: app.job_title,
        company: app.company,
        status: app.status,
        created_at: app.created_at,
        jobs: app.jobs,
      });

      if (!validation.valid) {
        console.warn(`[Data Validation] Filtering out application with errors:`, {
          appId: app.id,
          jobTitle: app.job_title,
          errors: validation.errors,
        });
      }

      return validation.valid;
    });
  }, [applications]);
}

/**
 * Get a readable error message for why data was filtered
 */
export function getFilterReasonMessage(jobsCount: number, filteredCount: number): string | null {
  if (filteredCount === 0 && jobsCount > 0) {
    return "No jobs matched the quality standards. Please check back later for properly formatted job listings.";
  }
  if (filteredCount < jobsCount) {
    const removed = jobsCount - filteredCount;
    return `Filtered out ${removed} job(s) with incomplete or invalid data to ensure quality.`;
  }
  return null;
}
