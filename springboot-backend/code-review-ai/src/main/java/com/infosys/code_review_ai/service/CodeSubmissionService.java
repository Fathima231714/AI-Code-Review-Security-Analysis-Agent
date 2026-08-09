package com.infosys.code_review_ai.service;

import com.infosys.code_review_ai.model.CodeSubmissionRequest;
import com.infosys.code_review_ai.model.CodeSubmissionResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CodeSubmissionService {

    private static final Pattern JAVA_CLASS = Pattern.compile("\\b(class|interface|enum|record)\\s+\\w+");
    private static final Pattern PYTHON_DEF = Pattern.compile("(?m)^\\s*(def|class)\\s+\\w+");

    private final Path uploadRoot;

    public CodeSubmissionService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public CodeSubmissionResponse handleUploadedFile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return invalid("unknown", "", "", List.of("Please upload a non-empty .java or .py file."));
        }

        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null
                ? "submission.txt"
                : file.getOriginalFilename());
        String code = new String(file.getBytes(), StandardCharsets.UTF_8);
        String language = detectLanguage(originalName, code);
        List<String> errors = validate(originalName, language, code);
        String submissionId = UUID.randomUUID().toString();

        Files.createDirectories(uploadRoot);
        String safeName = submissionId + "-" + originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        Files.writeString(uploadRoot.resolve(safeName), code, StandardCharsets.UTF_8);

        return new CodeSubmissionResponse(
                submissionId,
                originalName,
                language,
                errors.isEmpty(),
                errors,
                code,
                detectSecurityRisks(code));
    }

    public CodeSubmissionResponse handlePastedCode(CodeSubmissionRequest request) throws IOException {
        String code = request == null || request.code() == null ? "" : request.code();
        String fileName = request == null || request.fileName() == null || request.fileName().isBlank()
                ? defaultFileName(request == null ? "" : request.language(), code)
                : StringUtils.cleanPath(request.fileName());
        // Source syntax wins over a dropdown value. This prevents a pasted
        // Python snippet being reviewed as Java simply because the UI still
        // held its previous selection.
        String detectedLanguage = detectLanguage("", code);
        String language = !"unknown".equals(detectedLanguage)
                ? detectedLanguage
                : (request != null && request.language() != null && !request.language().isBlank()
                    ? normalizeLanguage(request.language())
                    : detectLanguage(fileName, code));
        if ("python".equals(language) && fileName.toLowerCase(Locale.ROOT).endsWith(".java")) {
            fileName = fileName.substring(0, fileName.length() - 5) + ".py";
        } else if ("java".equals(language) && fileName.toLowerCase(Locale.ROOT).endsWith(".py")) {
            fileName = fileName.substring(0, fileName.length() - 3) + ".java";
        }
        List<String> errors = validate(fileName, language, code);
        String submissionId = UUID.randomUUID().toString();

        Files.createDirectories(uploadRoot);
        Files.writeString(uploadRoot.resolve(submissionId + "-" + sanitizeFileName(fileName)), code, StandardCharsets.UTF_8);

        return new CodeSubmissionResponse(
                submissionId,
                fileName,
                language,
                errors.isEmpty(),
                errors,
                code,
                detectSecurityRisks(code));
    }

    private CodeSubmissionResponse invalid(
            String fileName, String language, String code, List<String> errors) {
        return new CodeSubmissionResponse(UUID.randomUUID().toString(), fileName, language, false, errors, code, List.of());
    }

    private String defaultFileName(String requestedLanguage, String code) {
        String language = requestedLanguage == null || requestedLanguage.isBlank()
                ? detectLanguage("", code)
                : normalizeLanguage(requestedLanguage);
        return "python".equals(language) ? "submission.py" : "submission.java";
    }

    private String detectLanguage(String fileName, String code) {
        String lowerName = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        if (lowerName.endsWith(".java")) {
            return "java";
        }
        if (lowerName.endsWith(".py")) {
            return "python";
        }
        if (JAVA_CLASS.matcher(code).find() || code.contains("public static void main")) {
            return "java";
        }
        if (PYTHON_DEF.matcher(code).find() || code.contains("import ") || code.contains("print(")) {
            return "python";
        }
        return "unknown";
    }

    private String normalizeLanguage(String language) {
        String normalized = language.toLowerCase(Locale.ROOT).trim();
        if ("py".equals(normalized)) {
            return "python";
        }
        return normalized;
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private List<String> validate(String fileName, String language, String code) {
        List<String> errors = new ArrayList<>();
        if (code == null || code.isBlank()) {
            errors.add("Code cannot be empty.");
            return errors;
        }
        if (!"java".equals(language) && !"python".equals(language)) {
            errors.add("Only Java and Python code are supported.");
        }
        if ("java".equals(language) && !fileName.toLowerCase(Locale.ROOT).endsWith(".java")) {
            errors.add("Java submissions must use a .java file name.");
        }
        if ("python".equals(language) && !fileName.toLowerCase(Locale.ROOT).endsWith(".py")) {
            errors.add("Python submissions must use a .py file name.");
        }
        if (hasUnbalanced(code, '{', '}')) {
            errors.add("Curly braces appear to be unbalanced.");
        }
        if (hasUnbalanced(code, '(', ')')) {
            errors.add("Parentheses appear to be unbalanced.");
        }
        if ("java".equals(language) && !JAVA_CLASS.matcher(code).find()) {
            errors.add("Java code should include a class, interface, enum, or record declaration.");
        }
        if ("python".equals(language) && hasLikelyPythonSyntaxIssue(code)) {
            errors.add("Python syntax looks incomplete. Check blocks, colons, and indentation.");
        }
        return errors;
    }

    private boolean hasUnbalanced(String code, char open, char close) {
        int depth = 0;
        for (char current : code.toCharArray()) {
            if (current == open) {
                depth++;
            } else if (current == close) {
                depth--;
            }
            if (depth < 0) {
                return true;
            }
        }
        return depth != 0;
    }

    private boolean hasLikelyPythonSyntaxIssue(String code) {
        String[] lines = code.split("\\R");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.matches("^(if|for|while|def|class|try|except|finally|with|elif|else)\\b.*")
                    && !trimmed.endsWith(":")) {
                return true;
            }
        }
        return false;
    }

    private List<String> detectSecurityRisks(String code) {
        String lower = code.toLowerCase(Locale.ROOT);
        List<String> risks = new ArrayList<>();
        if (lower.contains("select ") && (lower.contains("+") || lower.contains("format("))) {
            risks.add("Possible SQL Injection: query appears to be built with string concatenation or formatting.");
        }
        if (lower.contains("innerhtml") || lower.contains("document.write")) {
            risks.add("Possible XSS: HTML is written directly from code.");
        }
        if (lower.contains("password") || lower.contains("apikey") || lower.contains("api_key") || lower.contains("secret")) {
            risks.add("Possible hardcoded secret: sensitive names appear in source.");
        }
        if (lower.contains("csrf") && lower.contains("disable")) {
            risks.add("Possible CSRF issue: CSRF protection appears disabled.");
        }
        return risks;
    }
}

