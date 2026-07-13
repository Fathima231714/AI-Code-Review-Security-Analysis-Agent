package com.infosys.code_review_ai.controller;

import com.infosys.code_review_ai.model.AiQuestionRequest;
import com.infosys.code_review_ai.model.AiReviewRequest;
import com.infosys.code_review_ai.service.AiGatewayService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    public AiReviewController(AiGatewayService aiGatewayService) {
        this.aiGatewayService = aiGatewayService;
    }

    @PostMapping(
            value = "/api/review",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> review(@RequestBody AiReviewRequest request) {
        return ResponseEntity.ok(aiGatewayService.review(request));
    }

    @PostMapping(
            value = "/api/ask",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> ask(@RequestBody AiQuestionRequest request) {
        return ResponseEntity.ok(aiGatewayService.ask(request));
    }

    @GetMapping(value = "/api/knowledge/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> searchKnowledge(@RequestParam String q) {
        return ResponseEntity.ok(aiGatewayService.search(q));
    }
}
