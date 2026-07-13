package com.infosys.code_review_ai.model;

import java.util.List;

public record CodeSubmissionResponse(
        String submissionId,
        String fileName,
        String language,
        boolean valid,
        List<String> errors,
        String code,
        List<String> detectedRisks
) {
}
