package com.infosys.code_review_ai.service;

import com.infosys.code_review_ai.model.AiQuestionRequest;
import com.infosys.code_review_ai.model.AiReviewRequest;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class AiGatewayService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE =
            new ParameterizedTypeReference<>() {
            };

    private final RestClient restClient;

    public AiGatewayService(@Value("${ai.service.base-url:http://127.0.0.1:8000}") String aiServiceBaseUrl) {
        this.restClient = RestClient.builder()
                .baseUrl(aiServiceBaseUrl)
                .build();
    }

    public Map<String, Object> review(AiReviewRequest request) {
        try {
            Map<String, Object> payload = Map.of(
                    "code", request.code() == null ? "" : request.code(),
                    "language", request.language() == null ? "" : request.language(),
                    "submission_id", request.submissionId() == null ? "" : request.submissionId());
            return restClient.post()
                    .uri("/review")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(MAP_RESPONSE);
        } catch (RestClientException ex) {
            return unavailable("AI service is not reachable. Start FastAPI on port 8000, then retry.");
        }
    }

    public Map<String, Object> ask(AiQuestionRequest request) {
        try {
            Map<String, Object> payload = Map.of(
                    "question", request.question() == null ? "" : request.question(),
                    "review_id", request.reviewId() == null ? "" : request.reviewId());
            return restClient.post()
                    .uri("/ask")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(MAP_RESPONSE);
        } catch (RestClientException ex) {
            return unavailable("AI service is not reachable. Start FastAPI on port 8000, then retry.");
        }
    }

    public Map<String, Object> search(String query) {
        try {
            return restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/knowledge/search").queryParam("q", query).build())
                    .retrieve()
                    .body(MAP_RESPONSE);
        } catch (RestClientException ex) {
            return Map.of("query", query, "matches", List.of(), "error", "AI service is not reachable.");
        }
    }

    public byte[] report(String type, Map<String, Object> reportRequest) {
        try {
            return restClient.post()
                    .uri("/reports/" + type)
                    .body(reportRequest)
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientException ex) {
            throw new IllegalStateException("AI report service is not reachable.", ex);
        }
    }

    private Map<String, Object> unavailable(String message) {
        return Map.of(
                "response", message,
                "rag_matches", List.of());
    }
}
