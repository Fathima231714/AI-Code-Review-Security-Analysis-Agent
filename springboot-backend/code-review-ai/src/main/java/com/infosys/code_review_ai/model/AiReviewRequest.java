package com.infosys.code_review_ai.model;

public record AiReviewRequest(
        String code,
        String language,
        String submissionId,
        String fileName
) {
}
