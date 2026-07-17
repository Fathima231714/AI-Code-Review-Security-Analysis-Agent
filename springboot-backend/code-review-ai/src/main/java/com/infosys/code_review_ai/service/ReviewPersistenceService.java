package com.infosys.code_review_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infosys.code_review_ai.entity.ChatMessage;
import com.infosys.code_review_ai.entity.Review;
import com.infosys.code_review_ai.entity.Submission;
import com.infosys.code_review_ai.model.AiReviewRequest;
import com.infosys.code_review_ai.repository.ChatMessageRepository;
import com.infosys.code_review_ai.repository.ReviewRepository;
import com.infosys.code_review_ai.repository.SubmissionRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ReviewPersistenceService {
    private final SubmissionRepository submissions; private final ReviewRepository reviews; private final ChatMessageRepository chats; private final ObjectMapper objectMapper;
    public ReviewPersistenceService(SubmissionRepository submissions, ReviewRepository reviews, ChatMessageRepository chats, ObjectMapper objectMapper) { this.submissions=submissions; this.reviews=reviews; this.chats=chats; this.objectMapper=objectMapper; }
    public String saveReview(AiReviewRequest request, Map<String,Object> result) {
        String id = request.submissionId() == null || request.submissionId().isBlank() ? UUID.randomUUID().toString() : request.submissionId();
        Submission submission = submissions.findById(id).orElseGet(() -> submissions.save(new Submission(id, request.fileName() == null ? "Submission" : request.fileName(), request.language(), request.code())));
        try { return reviews.save(new Review(submission, objectMapper.writeValueAsString(result))).getId(); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Unable to serialize review", ex); }
    }
    public void saveChat(String reviewId, String question, Map<String,Object> result) { chats.save(new ChatMessage(reviewId, question, String.valueOf(result.getOrDefault("answer", "")))); }
}
