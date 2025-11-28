const axios = require('axios');

async function testWhatsAppTemplate() {
    try {
        const response = await axios.post('http://localhost:3000/api/whatsapp/send-template', {
            to: '255757714834',
            templateName: 'hello_world',
            languageCode: 'en_US'
        });

        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testWhatsAppTemplate();
