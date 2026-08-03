package com.infosys.code_review_ai.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiQuestionRequest(
        String question,
        @JsonAlias("review_id") String reviewId,
        @JsonAlias("review_findings") List<Map<String, Object>> reviewFindings,
        @JsonAlias("chat_history") List<Map<String, String>> chatHistory
) {
}
