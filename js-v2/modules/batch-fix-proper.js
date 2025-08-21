// Proper Batch Minting Fix - Using correct encoding for struct arrays
window.properBatchFix = {
    
    // Properly encode the batch call
    async executeBatchMint(contractInstance, batchNotices, totalFee) {
        try {
            console.log('Executing proper batch mint with correct struct encoding...');
            
            // The key is to pass the data in the exact format TronWeb expects
            // For struct arrays, we need to pass an array where each element
            // is an array of values (not an object)
            
            const formattedNotices = [];
            
            for (const notice of batchNotices) {
                // Each notice must be an array of values in the exact order
                // matching the struct definition in the contract
                formattedNotices.push([
                    notice.recipient,                    // address
                    notice.encryptedIPFS || '',         // string
                    notice.encryptionKey || '',         // string
                    notice.issuingAgency || '',         // string
                    notice.noticeType || '',            // string
                    notice.caseNumber || '',            // string
                    notice.caseDetails || '',           // string
                    notice.legalRights || '',           // string
                    Boolean(notice.sponsorFees),        // bool (must be boolean, not string)
                    notice.metadataURI || ''            // string
                ]);
            }
            
            console.log('Formatted notices for batch:', formattedNotices);
            
            // Call the contract method with the properly formatted array
            const tx = await contractInstance.serveNoticeBatch(formattedNotices).send({
                feeLimit: 2000000000,
                callValue: totalFee,
                shouldPollResponse: true
            });
            
            console.log('Batch transaction successful!', tx);
            return {
                success: true,
                txId: tx,
                alertTx: tx,
                documentTx: tx
            };
            
        } catch (error) {
            console.error('Batch mint with proper encoding failed:', error);
            
            // Try alternative approach using raw parameter encoding
            return await this.executeBatchMintRaw(contractInstance.address, batchNotices, totalFee);
        }
    },
    
    // Alternative: Build the transaction manually with proper ABI encoding
    async executeBatchMintRaw(contractAddress, batchNotices, totalFee) {
        try {
            console.log('Trying raw ABI encoding approach...');
            
            // Build the parameters array in the exact format needed
            const params = [];
            
            // Build the struct array parameter
            const structArray = {
                type: 'tuple[]',
                components: batchNotices.map(notice => ({
                    type: 'tuple',
                    value: [
                        { type: 'address', value: notice.recipient },
                        { type: 'string', value: notice.encryptedIPFS || '' },
                        { type: 'string', value: notice.encryptionKey || '' },
                        { type: 'string', value: notice.issuingAgency || '' },
                        { type: 'string', value: notice.noticeType || '' },
                        { type: 'string', value: notice.caseNumber || '' },
                        { type: 'string', value: notice.caseDetails || '' },
                        { type: 'string', value: notice.legalRights || '' },
                        { type: 'bool', value: Boolean(notice.sponsorFees) },
                        { type: 'string', value: notice.metadataURI || '' }
                    ]
                }))
            };
            
            params.push(structArray);
            
            // Use TronWeb's transaction builder
            const transaction = await window.tronWeb.transactionBuilder.triggerSmartContract(
                contractAddress,
                'serveNoticeBatch((address,string,string,string,string,string,string,string,bool,string)[])',
                {
                    feeLimit: 2000000000,
                    callValue: totalFee
                },
                params,
                window.tronWeb.defaultAddress.base58
            );
            
            const signedTx = await window.tronWeb.trx.sign(transaction.transaction);
            const result = await window.tronWeb.trx.sendRawTransaction(signedTx);
            
            console.log('Batch transaction sent with raw encoding:', result);
            return {
                success: true,
                txId: result.txid,
                alertTx: result.txid,
                documentTx: result.txid
            };
            
        } catch (error) {
            console.error('Raw encoding also failed:', error);
            throw error;
        }
    }
};

console.log('Proper batch fix module loaded');