package id.voidplaybox.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationPolicyTest {
    private final NavigationPolicy policy = new NavigationPolicy("https://voidplaybox.vercel.app/");

    @Test public void acceptsOnlyTheExactSecureOrigin() {
        assertTrue(policy.isInternal("https://voidplaybox.vercel.app/booking?x=1#map"));
        assertTrue(policy.isInternal("https://VOIDPLAYBOX.vercel.app:443/"));
        assertFalse(policy.isInternal("http://voidplaybox.vercel.app/"));
        assertFalse(policy.isInternal("https://voidplaybox.vercel.app.evil.example/"));
        assertFalse(policy.isInternal("https://voidplaybox.vercel.app@evil.example/"));
        assertFalse(policy.isInternal("https://evil@voidplaybox.vercel.app/"));
        assertFalse(policy.isInternal("https://voidplaybox.vercel.app:444/"));
        assertFalse(policy.isInternal(null));
    }

    @Test public void blocksExecutableLocalAndArbitraryIntentLinks() {
        for (String url : new String[] {"javascript:alert(1)", "file:///etc/passwd", "content://test",
                "data:text/html,test", "intent://scan/#Intent;end", "http://example.com", "not a url"}) {
            assertFalse(url, policy.canOpenExternally(url));
        }
        assertTrue(policy.canOpenExternally("https://wa.me/6285126539339"));
        assertTrue(policy.canOpenExternally("https://www.google.com/maps/dir/?api=1"));
        assertTrue(policy.canOpenExternally("tel:+6285126539339"));
        assertTrue(policy.canOpenExternally("mailto:playbox@mail.id"));
    }
}
