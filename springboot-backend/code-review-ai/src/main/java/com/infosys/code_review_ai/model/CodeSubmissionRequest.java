package com.infosys.code_review_ai.model;

public record CodeSubmissionRequest(
        String code,
        String fileName,
        String language
) {
}
