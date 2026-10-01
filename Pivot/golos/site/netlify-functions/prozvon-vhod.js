// Входящие на номер разведки +1 424 275 6121. Сюда попадает тот, кому Маша звонила
// и кто нажал «перезвонить». Голосового ассистента тут быть не должно: человек говорил
// с живым покупателем и не ждёт разговора с программой.
const XML = { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' };
exports.handler = async () => ({ statusCode: 200, headers: XML,
  body: '<?xml version="1.0" encoding="UTF-8"?><Response>'
      + '<Say voice="Polly.Joanna" language="en-US">Thanks for calling back. '
      + 'Please leave your name and number after the tone, and we will get back to you.</Say>'
      + '<Record maxLength="120" playBeep="true" timeout="5"/>'
      + '<Say voice="Polly.Joanna" language="en-US">Thank you. Goodbye.</Say><Hangup/></Response>' });
