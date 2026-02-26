(function() {
    function detectCurrency() {
        const selectors = [
            'meta[property="og:price:currency"]',
            'meta[name="currency"]',
            'meta[property="product:price:currency"]'
        ];
        for (const selector of selectors) {
            const meta = document.querySelector(selector);
            if (meta && meta.content) return meta.content.toUpperCase();
        }

        const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLd) {
            try {
                const data = JSON.parse(script.innerText);
                const findCurrency = (obj) => {
                    if (obj.priceCurrency) return obj.priceCurrency;
                    if (obj.offers) {
                        if (Array.isArray(obj.offers)) {
                            for (const offer of obj.offers) if (offer.priceCurrency) return offer.priceCurrency;
                        } else if (obj.offers.priceCurrency) {
                            return obj.offers.priceCurrency;
                        }
                    }
                    return null;
                };
                const res = Array.isArray(data) ? (data.map ? data.map(findCurrency).find(c => c) : findCurrency(data)) : findCurrency(data);
                if (res) return res.toUpperCase();
            } catch (e) {}
        }
        return null;
    }

    window.IyonicPay = {
        detectCurrency: detectCurrency,
        pay: function(config) {
            const { username, amount, description, currency, onSuccess, onCancel } = config;
            
            // Base URL of your application
            const baseUrl = window.location.origin.includes('localhost') ? 'http://localhost:5000' : 'https://pay.iyonicorp.com';
            
            const detectedCurrency = currency || detectCurrency() || 'USD';

            // Build the URL
            let url = `${baseUrl}/request?user=${username}`;
            if (amount) url += `&amount=${amount}`;
            if (description) url += `&desc=${encodeURIComponent(description)}`;
            url += `&currency=${detectedCurrency}`;
            
            // Open a popup
            const width = 500;
            const height = 800;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            const popup = window.open(url, 'IyonicPay', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
            
            if (!popup) {
                alert('Popup blocked! Please allow popups for this website.');
                return;
            }

            // Listen for success message from popup
            const messageListener = function(event) {
                // In production, you should check event.origin for security
                if (event.data && event.data.type === 'iyonicpay-success') {
                    window.removeEventListener('message', messageListener);
                    if (onSuccess) onSuccess(event.data.reference);
                }
            };

            window.addEventListener('message', messageListener);

            // Check if popup is closed
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageListener);
                    // If not already succeeded, it's a cancel/close
                    if (onCancel) onCancel();
                }
            }, 1000);
        }
    };
})();
