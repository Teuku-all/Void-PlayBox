package id.voidplaybox.app;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Only the configured HTTPS origin may run inside the app. */
final class NavigationPolicy {
    private final URI home;

    NavigationPolicy(String homeUrl) {
        home = URI.create(homeUrl);
        if (!"https".equals(home.getScheme()) || home.getHost() == null) {
            throw new IllegalArgumentException("WEB_URL must be an HTTPS URL");
        }
    }

    boolean isInternal(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && home.getHost().equalsIgnoreCase(uri.getHost())
                    && port(home) == port(uri) && uri.getUserInfo() == null;
        } catch (URISyntaxException | NullPointerException ex) {
            return false;
        }
    }

    boolean canOpenExternally(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if (scheme == null || uri.getUserInfo() != null) return false;
            switch (scheme.toLowerCase(Locale.ROOT)) {
                case "https": return uri.getHost() != null;
                case "tel": case "mailto": case "geo": case "whatsapp": return true;
                default: return false;
            }
        } catch (URISyntaxException | NullPointerException ex) {
            return false;
        }
    }

    private static int port(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }
}
