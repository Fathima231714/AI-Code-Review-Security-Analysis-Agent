package com.infosys.code_review_ai.controller;

import com.infosys.code_review_ai.model.AiQuestionRequest;
import com.infosys.code_review_ai.model.AiReviewRequest;
import com.infosys.code_review_ai.service.AiGatewayService;
import com.infosys.code_review_ai.service.ReviewPersistenceService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class AiReviewController {

    private final AiGatewayService aiGatewayService;
    private final ReviewPersistenceService persistenceService;

    public AiReviewController(AiGatewayService aiGatewayService, ReviewPersistenceService persistenceService) {
        this.aiGatewayService = aiGatewayService;
        this.persistenceService = persistenceService;
    }

    @PostMapping(
            value = "/api/review",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> review(@RequestBody AiReviewRequest request) {
        Map<String, Object> result = aiGatewayService.review(request);
        if (result.containsKey("review")) {
            result.put("reviewId", persistenceService.saveReview(request, result));
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping(
            value = "/api/ask",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> ask(@RequestBody AiQuestionRequest request) {
        Map<String, Object> result = aiGatewayService.ask(request);
        if (request.reviewId() != null && !request.reviewId().isBlank()) {
            persistenceService.saveChat(request.reviewId(), request.question(), result);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping(value = "/api/knowledge/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> searchKnowledge(@RequestParam String q) {
        return ResponseEntity.ok(aiGatewayService.search(q));
    }

    @GetMapping(value = "/api/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(aiGatewayService.status());
    }

    @GetMapping(value = "/api/reviews/history", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> reviewHistory() {
        return ResponseEntity.ok(Map.of("reviews", persistenceService.recentReviews()));
    }

    @PostMapping(value = "/api/reports/{type}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> report(@org.springframework.web.bind.annotation.PathVariable String type,
                                         @RequestBody Map<String, Object> request) {
        if (!"html".equals(type) && !"pdf".equals(type)) {
            return ResponseEntity.badRequest().build();
        }
        byte[] data = aiGatewayService.report(type, request);
        String extension = "pdf".equals(type) ? "pdf" : "html";
        MediaType contentType = "pdf".equals(type) ? MediaType.APPLICATION_PDF : MediaType.TEXT_HTML;
        return ResponseEntity.ok().contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=code-review-report." + extension)
                .body(data);
    }
}
