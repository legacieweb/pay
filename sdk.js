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

    function createModal(url, onCancel) {
        const modalId = 'iyonicpay-modal-' + Math.random().toString(36).substr(2, 9);
        const styleId = 'iyonicpay-style';

        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .iyonicpay-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(8px);
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .iyonicpay-container {
                    width: 90%;
                    max-width: 500px;
                    height: 85%;
                    max-height: 800px;
                    background: white;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    transform: translateY(20px);
                    transition: transform 0.3s ease;
                    position: relative;
                }
                .iyonicpay-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .iyonicpay-close {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    width: 32px;
                    height: 32px;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 10;
                    border: none;
                    font-size: 20px;
                    font-weight: bold;
                    color: #64748b;
                    transition: all 0.2s ease;
                }
                .iyonicpay-close:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                    transform: scale(1.1);
                }
                .iyonicpay-visible {
                    opacity: 1;
                }
                .iyonicpay-visible .iyonicpay-container {
                    transform: translateY(0);
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.className = 'iyonicpay-overlay';
        overlay.innerHTML = `
            <div class="iyonicpay-container">
                <button class="iyonicpay-close" title="Close">&times;</button>
                <iframe src="${url}" class="iyonicpay-iframe"></iframe>
            </div>
        `;

        document.body.appendChild(overlay);

        // Force reflow for animation
        overlay.offsetHeight;
        overlay.classList.add('iyonicpay-visible');

        const closeBtn = overlay.querySelector('.iyonicpay-close');
        const closeModal = () => {
            overlay.classList.remove('iyonicpay-visible');
            setTimeout(() => {
                overlay.remove();
                if (onCancel) onCancel();
            }, 300);
        };

        closeBtn.onclick = closeModal;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeModal();
        };

        return {
            close: closeModal,
            element: overlay
        };
    }

    window.IyonicPay = {
        detectCurrency: detectCurrency,
        pay: function(config) {
            const { username, amount, description, currency, onSuccess, onCancel } = config;
            
            const baseUrl = window.location.origin.includes('localhost') ? 'http://localhost:5000' : 'https://pay.iyonicorp.com';
            const detectedCurrency = currency || detectCurrency() || 'USD';

            let url = `${baseUrl}/request?user=${username}&embed=true`;
            if (amount) url += `&amount=${amount}`;
            if (description) url += `&desc=${encodeURIComponent(description)}`;
            url += `&currency=${detectedCurrency}`;
            
            const modal = createModal(url, onCancel);

            const messageListener = function(event) {
                if (event.data && event.data.type === 'iyonicpay-success') {
                    window.removeEventListener('message', messageListener);
                    modal.close();
                    if (onSuccess) onSuccess(event.data.reference);
                }
            };

            window.addEventListener('message', messageListener);
        }
    };
})();
