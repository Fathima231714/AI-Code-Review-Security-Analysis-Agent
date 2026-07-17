package com.infosys.code_review_ai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;

@Entity
public class ChatMessage {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String reviewId;
    @Column(length = 10000) private String question;
    @Column(length = 100000) private String answer;
    private Instant createdAt = Instant.now();
    protected ChatMessage() {}
    public ChatMessage(String reviewId, String question, String answer) { this.reviewId=reviewId; this.question=question; this.answer=answer; }
}
