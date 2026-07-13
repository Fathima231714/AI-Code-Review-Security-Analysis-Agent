import java.sql.*;

public class Demo {
  public static void main(String[] args) throws Exception {
    String user = args.length > 0 ? args[0] : "guest";
    String sql = "SELECT * FROM users WHERE username = '" + user + "'";
    Statement st = null;
    ResultSet rs = null;
    System.out.println(sql);
  }
}
