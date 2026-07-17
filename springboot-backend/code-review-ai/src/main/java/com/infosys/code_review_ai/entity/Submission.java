package com.infosys.code_review_ai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.Instant;

@Entity
public class Submission {
    @Id
    private String id;
    private String fileName;
    private String language;
    @Column(length = 500000)
    private String sourceCode;
    private Instant createdAt = Instant.now();
    protected Submission() {}
    public Submission(String id, String fileName, String language, String sourceCode) { this.id=id; this.fileName=fileName; this.language=language; this.sourceCode=sourceCode; }
    public String getId() { return id; }
}
