
const stripe = Stripe('pk_test_51NT3jiSCKIwEA6d8j5ZrxDo3KtcBkW5sjWuuah0bs0ywFtMZSAoGo94D4dO27niSbQhT95SXCFsj7XNFlJoH2ynC00cOQnONH1');
const orderBtn = document.getElementById('order-btn');
const sessionId = orderBtn.parentNode.querySelector('[name=sessionId]').value;
orderBtn.addEventListener('click', function() {
    stripe.redirectToCheckout({
        sessionId: sessionId
    });
});