/**
 * Generate Placeholder Images for Existing Notices
 * Creates base64 placeholder images for notices with broken file paths
 */

function generatePlaceholderImages() {
    console.log('🎨 Generating placeholder images for existing notices...');

    /**
     * Generate a simple alert thumbnail as base64
     */
    function generateAlertThumbnail(noticeId, caseNumber) {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 400, 300);

        // Border
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, 380, 280);

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL NOTICE', 200, 50);

        // Notice ID
        ctx.font = '18px Arial';
        ctx.fillText(`Notice #${noticeId}`, 200, 100);

        // Case Number
        if (caseNumber) {
            ctx.font = '16px Arial';
            ctx.fillText(`Case: ${caseNumber}`, 200, 140);
        }

        // Status
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('DELIVERED', 200, 200);

        // Timestamp
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Arial';
        ctx.fillText(new Date().toLocaleDateString(), 200, 250);

        return canvas.toDataURL('image/png');
    }

    /**
     * Generate a simple document image as base64
     */
    function generateDocumentImage(noticeId, caseNumber, recipientAddress) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 600, 800);

        // Border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 560, 760);

        // Header
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 28px Times New Roman';
        ctx.textAlign = 'center';
        ctx.fillText('LEGAL DOCUMENT', 300, 80);

        // Subheader
        ctx.font = '20px Times New Roman';
        ctx.fillText('NOTICE OF SERVICE', 300, 120);

        // Line
        ctx.beginPath();
        ctx.moveTo(50, 140);
        ctx.lineTo(550, 140);
        ctx.stroke();

        // Content
        ctx.font = '16px Times New Roman';
        ctx.textAlign = 'left';
        
        ctx.fillText(`Notice ID: ${noticeId}`, 60, 180);
        ctx.fillText(`Case Number: ${caseNumber || 'N/A'}`, 60, 210);
        ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 60, 240);
        
        // Body text
        ctx.font = '14px Times New Roman';
        const bodyText = [
            'This is to certify that legal notice has been properly',
            'served in accordance with applicable laws and regulations.',
            '',
            'The recipient has been duly notified of the legal proceedings',
            'and all relevant documentation has been delivered.',
            '',
            'This notice is served via blockchain technology and is',
            'cryptographically secured and verifiable on the TRON network.'
        ];

        let yPos = 300;
        bodyText.forEach(line => {
            ctx.fillText(line, 60, yPos);
            yPos += 25;
        });

        // Recipient section
        ctx.font = 'bold 16px Times New Roman';
        ctx.fillText('RECIPIENT:', 60, yPos + 40);
        ctx.font = '14px Times New Roman';
        ctx.fillText(recipientAddress || 'See Blockchain Record', 60, yPos + 65);

        // Footer
        ctx.font = '12px Times New Roman';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666666';
        ctx.fillText('This document is generated for display purposes', 300, 720);
        ctx.fillText('Original record stored on TRON blockchain', 300, 740);

        return canvas.toDataURL('image/png');
    }

    /**
     * Update images via API
     */
    async function updateNoticeImages(noticeId, alertImage, documentImage, caseNumber) {
        try {
            const response = await fetch(`${window.location.origin}/api/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                },
                body: JSON.stringify({
                    notice_id: noticeId.toString(),
                    server_address: 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                    recipient_address: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', // Default
                    alert_image: alertImage,
                    document_image: documentImage,
                    alert_thumbnail: alertImage,
                    document_thumbnail: documentImage,
                    case_number: caseNumber
                })
            });

            if (response.ok) {
                console.log(`✅ Updated images for notice ${noticeId}`);
                return true;
            } else {
                console.error(`Failed to update notice ${noticeId}:`, await response.text());
                return false;
            }
        } catch (error) {
            console.error(`Error updating notice ${noticeId}:`, error);
            return false;
        }
    }

    /**
     * Process all notices that need placeholder images
     */
    async function processAllNotices() {
        // List of notices that need updating (from the database query)
        const noticesToUpdate = [
            { id: '2', caseNumber: 'CASE-2' },
            { id: '4', caseNumber: 'CASE-4' },
            { id: '854683800', caseNumber: 'TEST-001' },
            { id: '854683801', caseNumber: 'TEST-002' },
            { id: '854683802', caseNumber: 'TEST-003' },
            { id: '291224101', caseNumber: 'TEST-004' },
            { id: '6', caseNumber: 'CASE-6' },
            { id: '8', caseNumber: 'CASE-8' },
            { id: '12', caseNumber: 'CASE-12' },
            { id: '14', caseNumber: 'CASE-14' },
            { id: '287113900', caseNumber: '34-2501-17850' }
        ];

        let updated = 0;
        let failed = 0;

        for (const notice of noticesToUpdate) {
            console.log(`Processing notice ${notice.id}...`);
            
            // Generate images
            const alertImage = generateAlertThumbnail(notice.id, notice.caseNumber);
            const documentImage = generateDocumentImage(notice.id, notice.caseNumber);
            
            // Update in database
            const success = await updateNoticeImages(
                notice.id,
                alertImage,
                documentImage,
                notice.caseNumber
            );
            
            if (success) {
                updated++;
            } else {
                failed++;
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n📊 Update Summary:`);
        console.log(`   ✅ Successfully updated: ${updated}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   Total processed: ${noticesToUpdate.length}`);
    }

    // Run the update process
    processAllNotices();
}

// Auto-run when loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', generatePlaceholderImages);
} else {
    generatePlaceholderImages();
}