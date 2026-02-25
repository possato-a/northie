/**
 * Northie Pixel Snippet Utility
 * Generates the JavaScript code to be embedded on client websites.
 */

export function generatePixelSnippet(profileId: string, backendUrl: string): string {
    return `
<!-- Northie Pixel -->
<script>
(function(w, d, s, l, i) {
    const n = w.Northie = w.Northie || [];
    n.profileId = i;
    n.backendUrl = '${backendUrl}';
    
    // 1. Get/Create Visitor ID
    let vid = localStorage.getItem('northie_vid');
    if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('northie_vid', vid);
    }
    
    // 2. Capture UTMs
    const params = new URLSearchParams(w.location.search);
    const eventData = {
        visitor_id: vid,
        page_url: w.location.href,
        referrer: d.referrer,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term'),
        gclid: params.get('gclid'),
        fbclid: params.get('fbclid')
    };
    
    // 3. Send to Northie
    fetch(n.backendUrl + '/api/pixel/event', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-profile-id': n.profileId 
        },
        body: JSON.stringify(eventData)
    }).catch(err => console.error('Northie Pixel Error:', err));
    
})(window, document, 'script', 'northie', '${profileId}');
</script>
<!-- End Northie Pixel -->
    `.trim();
}
