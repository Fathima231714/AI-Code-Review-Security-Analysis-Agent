public class DemoXss {
  public static void main(String[] args) {
    String input = "<script>alert('xss')</script>";
    String html = "<div>" + input + "</div>";
    System.out.println(html);
  }
}
