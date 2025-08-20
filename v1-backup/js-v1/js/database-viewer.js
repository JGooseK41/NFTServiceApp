/**
 * DATABASE VIEWER
 * Direct database visibility tool
 */

console.log('🗄️ DATABASE VIEWER');
console.log('=' .repeat(70));

window.DatabaseViewer = {
    
    async viewNotices() {
        console.log('\n📋 FETCHING NOTICES FROM DATABASE...');
        
        try {
            const response = await fetch('/api/notices', {
                headers: {
                    'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const notices = await response.json();
            
            console.log(`Found ${notices.length} notices in database:\n`);
            
            // Create summary table
            const summary = notices.map(n => ({
                ID: n.id,
                AlertID: n.alert_nft_id,
                DocID: n.document_nft_id,
                Case: n.case_number,
                Recipient: n.recipient_name?.substring(0, 20),
                Status: n.status,
                Created: new Date(n.created_at).toLocaleDateString()
            }));
            
            console.table(summary);
            
            // Store for further inspection
            window.dbNotices = notices;
            console.log('\nFull data stored in window.dbNotices');
            
            return notices;
            
        } catch (error) {
            console.error('Failed to fetch notices:', error);
            return [];
        }
    },
    
    async viewAlertMetadata() {
        console.log('\n🎯 FETCHING ALERT METADATA...');
        
        try {
            // Try each known alert
            const alerts = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
            const results = [];
            
            for (const alertId of alerts) {
                try {
                    const response = await fetch(`/api/alerts/alert/${alertId}/metadata`);
                    if (response.ok) {
                        const data = await response.json();
                        results.push({
                            AlertID: alertId,
                            Type: data.type,
                            HasMetadata: !!data.metadata,
                            HasDescription: !!data.metadata?.description,
                            HasImage: !!data.metadata?.image,
                            BlockServed: data.blockserved_compatible
                        });
                    }
                } catch (e) {
                    // Skip if not found
                }
            }
            
            if (results.length > 0) {
                console.table(results);
            } else {
                console.log('No alert metadata found in database');
            }
            
            return results;
            
        } catch (error) {
            console.error('Failed to fetch alert metadata:', error);
            return [];
        }
    },
    
    async viewProcessServers() {
        console.log('\n👥 FETCHING PROCESS SERVERS...');
        
        try {
            const response = await fetch('/api/process-servers');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const servers = await response.json();
            
            console.log(`Found ${servers.length} process servers:\n`);
            
            const summary = servers.map(s => ({
                ID: s.id,
                Name: s.name,
                Address: s.wallet_address?.substring(0, 10) + '...',
                Status: s.status,
                NoticeCount: s.notice_count || 0,
                Verified: s.verified ? '✅' : '❌'
            }));
            
            console.table(summary);
            
            window.dbServers = servers;
            console.log('\nFull data stored in window.dbServers');
            
            return servers;
            
        } catch (error) {
            console.error('Failed to fetch servers:', error);
            return [];
        }
    },
    
    async viewDatabaseStats() {
        console.log('\n📊 DATABASE STATISTICS');
        console.log('=' .repeat(50));
        
        try {
            // Get counts from various tables
            const stats = {};
            
            // Notices
            const noticesResp = await fetch('/api/notices');
            if (noticesResp.ok) {
                const notices = await noticesResp.json();
                stats.totalNotices = notices.length;
                stats.pendingNotices = notices.filter(n => n.status === 'pending').length;
                stats.servedNotices = notices.filter(n => n.status === 'served').length;
                stats.acknowledgedNotices = notices.filter(n => n.status === 'acknowledged').length;
            }
            
            // Process servers
            const serversResp = await fetch('/api/process-servers');
            if (serversResp.ok) {
                const servers = await serversResp.json();
                stats.totalServers = servers.length;
                stats.activeServers = servers.filter(s => s.status === 'active').length;
            }
            
            // Display stats
            console.log('\n📈 Current Database Status:');
            console.table(stats);
            
            // Check for issues
            console.log('\n⚠️ Potential Issues:');
            
            if (stats.totalNotices > 0) {
                const nullImageCount = await this.checkNullImages();
                if (nullImageCount > 0) {
                    console.log(`- ${nullImageCount} notices with null image references`);
                }
            }
            
            return stats;
            
        } catch (error) {
            console.error('Failed to get stats:', error);
            return {};
        }
    },
    
    async checkNullImages() {
        // Check for the null image fetch errors
        const response = await fetch('/api/notices');
        if (!response.ok) return 0;
        
        const notices = await response.json();
        const nullImages = notices.filter(n => !n.alert_nft_id || n.alert_nft_id === 'null');
        
        if (nullImages.length > 0) {
            console.log('\n❌ Notices with null alert IDs:', nullImages.map(n => n.id));
        }
        
        return nullImages.length;
    },
    
    async fixNullReferences() {
        console.log('\n🔧 FIXING NULL REFERENCES...');
        
        const response = await fetch('/api/notices');
        if (!response.ok) return;
        
        const notices = await response.json();
        const needsFix = notices.filter(n => !n.alert_nft_id || n.alert_nft_id === 'null');
        
        if (needsFix.length === 0) {
            console.log('No null references found');
            return;
        }
        
        console.log(`Found ${needsFix.length} notices needing fixes`);
        
        for (const notice of needsFix) {
            // Calculate correct alert/document IDs
            const noticeNumber = notice.id;
            const alertId = noticeNumber * 2 - 1;
            const documentId = noticeNumber * 2;
            
            console.log(`Fixing notice ${notice.id}: Alert #${alertId}, Document #${documentId}`);
            
            try {
                await fetch(`/api/notices/${notice.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                    },
                    body: JSON.stringify({
                        alert_nft_id: alertId,
                        document_nft_id: documentId
                    })
                });
                
                console.log(`✅ Fixed notice ${notice.id}`);
            } catch (e) {
                console.error(`Failed to fix notice ${notice.id}:`, e);
            }
        }
        
        console.log('\n✅ Fix complete');
    },
    
    async viewAll() {
        console.log('\n🗄️ COMPLETE DATABASE VIEW');
        console.log('=' .repeat(70));
        
        await this.viewDatabaseStats();
        await this.viewNotices();
        await this.viewAlertMetadata();
        await this.viewProcessServers();
        
        console.log('\n✅ Database view complete');
        console.log('\nAvailable data:');
        console.log('  window.dbNotices - All notices');
        console.log('  window.dbServers - All process servers');
    }
};

// Auto-run database view
console.log('Loading database view...\n');
DatabaseViewer.viewAll().then(() => {
    console.log('\n' + '=' .repeat(70));
    console.log('Commands:');
    console.log('  DatabaseViewer.viewNotices()       - View all notices');
    console.log('  DatabaseViewer.viewAlertMetadata() - View alert metadata');
    console.log('  DatabaseViewer.viewProcessServers() - View servers');
    console.log('  DatabaseViewer.viewDatabaseStats()  - View statistics');
    console.log('  DatabaseViewer.fixNullReferences()  - Fix null alert IDs');
    console.log('  DatabaseViewer.viewAll()           - View everything');
});