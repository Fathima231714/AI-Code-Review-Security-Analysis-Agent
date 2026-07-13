package com.infosys.code_review_ai.controller;

import com.infosys.code_review_ai.model.CodeSubmissionRequest;
import com.infosys.code_review_ai.model.CodeSubmissionResponse;
import com.infosys.code_review_ai.service.CodeSubmissionService;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

@Controller
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class UploadController {

    private final CodeSubmissionService submissionService;

    public UploadController(CodeSubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @PostMapping(
            value = "/api/submissions/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CodeSubmissionResponse> uploadCodeFile(
            @RequestParam("codeFile") MultipartFile file) throws IOException {
        return ResponseEntity.ok(submissionService.handleUploadedFile(file));
    }

    @PostMapping(
            value = "/api/submissions/paste",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CodeSubmissionResponse> pasteCode(
            @RequestBody CodeSubmissionRequest request) throws IOException {
        return ResponseEntity.ok(submissionService.handlePastedCode(request));
    }

    @PostMapping("/upload")
    public String uploadFile(@RequestParam("codeFile") MultipartFile file, Model model) throws IOException {
        CodeSubmissionResponse response = submissionService.handleUploadedFile(file);
        model.addAttribute("fileName", response.fileName());
        model.addAttribute("message", response.valid()
                ? "File uploaded and validated successfully!"
                : "File uploaded, but validation found issues.");
        model.addAttribute("language", response.language());
        model.addAttribute("code", response.code());
        model.addAttribute("errors", response.errors());
        return "result";
    }
}
