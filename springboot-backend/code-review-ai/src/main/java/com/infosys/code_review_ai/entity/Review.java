package com.infosys.code_review_ai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import java.time.Instant;

@Entity
public class Review {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @ManyToOne
    private Submission submission;
    @Column(length = 500000)
    private String resultJson;
    private Instant createdAt = Instant.now();
    protected Review() {}
    public Review(Submission submission, String resultJson) { this.submission=submission; this.resultJson=resultJson; }
    public String getId() { return id; }
    public Submission getSubmission() { return submission; }
    public String getResultJson() { return resultJson; }
    public Instant getCreatedAt() { return createdAt; }
}
