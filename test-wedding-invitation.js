const axios = require('axios');

async function testWeddingInvitation() {
    try {
        const payload = {
            to: '255757714834', // Replace with your test number
            templateName: 'wedding_invitation_with_image',
            languageCode: 'en', // Changed to 'en' based on "English"
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'image',
                            image: {
                                link: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=800&auto=format&fit=crop' // Portrait wedding image
                            }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: 'Gift Msigwa' },                // {{1}} Guest Name
                        { type: 'text', text: 'Peterson Mahinyila' },         // {{2}} Parents Name
                        { type: 'text', text: 'Justine Peterson' },           // {{3}} Groom
                        { type: 'text', text: 'Eli Kingo' },                  // {{4}} Bride
                        { type: 'text', text: 'The Kilimanjaro Hotel' },      // {{5}} Location (based on "on The Kilimanjaro Hotel")
                        { type: 'text', text: '28 September 2025' },          // {{6}} Date (based on "at 28 September 2025")
                        { type: 'text', text: '7:00 PM' },                    // {{7}} Start Time
                        { type: 'text', text: '11:00 PM' }                    // {{8}} End Time
                    ]
                }
            ]
        };

        console.log('Sending payload:', JSON.stringify(payload, null, 2));

        // Note: The URL might need adjustment based on actual routes
        const response = await axios.post('http://localhost:3001/api/whatsapp/send-template', payload);

        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testWeddingInvitation();
