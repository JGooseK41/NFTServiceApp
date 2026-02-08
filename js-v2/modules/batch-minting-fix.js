// Batch Minting Fix - Direct Contract Call
window.batchMintingFix = {
    
    // Direct batch mint using raw transaction
    async executeBatchMint(contractAddress, batchNotices, totalFee) {
        try {
            console.log('Executing batch mint with raw transaction approach...');
            
            // Build the function signature
            const functionSig = 'serveNoticeBatch((address,string,string,string,string,string,string,string,bool,string)[])';
            
            // Encode the parameters manually
            const types = [];
            const values = [];
            
            // For each notice, add the tuple components
            batchNotices.forEach(notice => {
                // Add each field with proper types
                types.push('address');
                values.push(notice.recipient);
                
                types.push('string');
                values.push(notice.encryptedIPFS || '');
                
                types.push('string');
                values.push(notice.encryptionKey || '');
                
                types.push('string');
                values.push(notice.issuingAgency || 'via Blockserved.com');
                
                types.push('string');
                values.push(notice.noticeType || 'legal_notice');
                
                types.push('string');
                values.push(notice.caseNumber || '');
                
                types.push('string');
                values.push(notice.caseDetails || '');
                
                types.push('string');
                values.push(notice.legalRights || 'View full document at www.BlockServed.com');
                
                types.push('bool');
                values.push(notice.sponsorFees || false);
                
                types.push('string');
                values.push(notice.metadataURI || '');
            });
            
            // Use TronWeb's ABI encoder
            const encoded = window.tronWeb.utils.abi.encodeParams(types, values);
            
            // Build transaction
            const transaction = await window.tronWeb.transactionBuilder.triggerSmartContract(
                contractAddress,
                functionSig,
                {
                    feeLimit: 2000000000,
                    callValue: totalFee
                },
                [],
                window.tronWeb.defaultAddress.base58,
                encoded
            );
            
            // Sign and send
            const signedTx = await window.tronWeb.trx.sign(transaction.transaction);
            const result = await window.tronWeb.trx.sendRawTransaction(signedTx);
            
            console.log('Batch mint transaction sent:', result);
            return result;
            
        } catch (error) {
            console.error('Batch mint failed:', error);
            throw error;
        }
    },
    
    // Alternative: Sequential minting as absolute fallback
    async mintSequentially(contractInstance, batchNotices, creationFee) {
        console.log('Falling back to sequential minting...');
        const results = [];
        
        for (let i = 0; i < batchNotices.length; i++) {
            const notice = batchNotices[i];
            console.log(`Minting ${i + 1}/${batchNotices.length} for ${notice.recipient}`);
            
            try {
                // Create single notice
                const tx = await contractInstance.serveNotice(
                    notice.recipient,
                    notice.encryptedIPFS,
                    notice.encryptionKey,
                    notice.issuingAgency,
                    notice.noticeType,
                    notice.caseNumber,
                    notice.caseDetails,
                    notice.legalRights,
                    notice.sponsorFees,
                    notice.metadataURI
                ).send({
                    feeLimit: 500000000,
                    callValue: creationFee * 2, // Alert + Document
                    shouldPollResponse: true
                });
                
                results.push({ 
                    recipient: notice.recipient, 
                    txId: tx,
                    success: true 
                });
                
                // Small delay between transactions
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed for recipient ${notice.recipient}:`, error);
                results.push({ 
                    recipient: notice.recipient, 
                    error: error.message,
                    success: false 
                });
            }
        }
        
        return {
            success: results.every(r => r.success),
            results,
            message: `Minted ${results.filter(r => r.success).length}/${batchNotices.length} successfully`
        };
    }
};

console.log('Batch minting fix module loaded');