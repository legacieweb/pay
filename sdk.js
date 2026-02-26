(function() {
    window.IyonicPay = {
        pay: function(config) {
            const { username, amount, description, onSuccess, onCancel } = config;
            
            // Base URL of your application
            const baseUrl = window.location.origin.includes('localhost') ? 'http://localhost:5000' : 'https://pay.iyonicorp.com';
            
            // Build the URL
            let url = `${baseUrl}/request?user=${username}`;
            if (amount) url += `&amount=${amount}`;
            if (description) url += `&desc=${encodeURIComponent(description)}`;
            
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
