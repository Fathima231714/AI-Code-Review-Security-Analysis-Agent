package com.infosys.code_review_ai.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiReviewRequest(
        String code,
        String language,
        @JsonAlias("submission_id") String submissionId,
        @JsonAlias("file_name") String fileName
) {
}
