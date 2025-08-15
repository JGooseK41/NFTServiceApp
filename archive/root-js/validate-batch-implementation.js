#!/usr/bin/env node

/**
 * Validation script to check batch implementation without database
 * Validates file structure, code syntax, and integration points
 */

const fs = require('fs');
const path = require('path');

console.log('Batch Implementation Validation');
console.log('===============================\n');

const validationResults = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function validateFile(filePath, description) {
    console.log(`Checking: ${description}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`   ❌ File not found: ${filePath}`);
        validationResults.failed++;
        return false;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check file is not empty
        if (content.trim().length === 0) {
            console.log(`   ❌ File is empty: ${filePath}`);
            validationResults.failed++;
            return false;
        }
        
        // Check for syntax errors in JS files
        if (filePath.endsWith('.js')) {
            try {
                new Function(content);
            } catch (syntaxError) {
                console.log(`   ❌ Syntax error: ${syntaxError.message}`);
                validationResults.failed++;
                return false;
            }
        }
        
        console.log(`   ✅ ${description}`);
        validationResults.passed++;
        return true;
        
    } catch (error) {
        console.log(`   ❌ Error reading file: ${error.message}`);
        validationResults.failed++;
        return false;
    }
}

function validateCodeIntegration(filePath, searchPattern, description) {
    console.log(`Checking: ${description}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`   ❌ File not found: ${filePath}`);
        validationResults.failed++;
        return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const found = searchPattern.test(content);
    
    if (found) {
        console.log(`   ✅ ${description}`);
        validationResults.passed++;
        return true;
    } else {
        console.log(`   ❌ ${description} - pattern not found`);
        validationResults.failed++;
        return false;
    }
}

// 1. Core Files
console.log('1. Core Implementation Files:');
validateFile('./js/id-manager.js', 'ID Manager');
validateFile('./js/batch-validator.js', 'Batch Validator');
validateFile('./js/batch-upload.js', 'Batch Upload Handler');
validateFile('./backend/routes/batch-documents.js', 'Backend Batch Route');
validateFile('./backend/migrations/005_fix_notice_id_overflow.sql', 'Database Migration');
console.log('');

// 2. Integration Points
console.log('2. Integration Points:');
validateCodeIntegration(
    './backend/server.js', 
    /require\(['"]\.\/routes\/batch-documents['"]\)/,
    'Batch router imported in server.js'
);
validateCodeIntegration(
    './backend/server.js',
    /app\.use\(['"]\/api\/batch['"], batchRouter\)/,
    'Batch router registered in server.js'
);
validateCodeIntegration(
    './index.html',
    /window\.uploadBatchDocuments/,
    'Batch upload function available in frontend'
);
console.log('');

// 3. ID Management Validation
console.log('3. ID Management System:');
if (fs.existsSync('./js/id-manager.js')) {
    const idManagerContent = fs.readFileSync('./js/id-manager.js', 'utf8');
    
    if (/generateSafeIntegerId/.test(idManagerContent)) {
        console.log('   ✅ Safe ID generation function present');
        validationResults.passed++;
    } else {
        console.log('   ❌ Safe ID generation function missing');
        validationResults.failed++;
    }
    
    if (/2147483647/.test(idManagerContent)) {
        console.log('   ✅ PostgreSQL INTEGER limit check present');
        validationResults.passed++;
    } else {
        console.log('   ❌ PostgreSQL INTEGER limit check missing');
        validationResults.failed++;
    }
}
console.log('');

// 4. Database Schema Validation
console.log('4. Database Schema:');
if (fs.existsSync('./backend/migrations/005_fix_notice_id_overflow.sql')) {
    const migrationContent = fs.readFileSync('./backend/migrations/005_fix_notice_id_overflow.sql', 'utf8');
    
    if (/ALTER COLUMN notice_id TYPE TEXT/.test(migrationContent)) {
        console.log('   ✅ Notice ID column type change to TEXT');
        validationResults.passed++;
    } else {
        console.log('   ❌ Notice ID column type change missing');
        validationResults.failed++;
    }
    
    if (/CREATE TABLE.*batch_uploads/.test(migrationContent)) {
        console.log('   ✅ Batch uploads table creation');
        validationResults.passed++;
    } else {
        console.log('   ❌ Batch uploads table creation missing');
        validationResults.failed++;
    }
}
console.log('');

// 5. Error Recovery Mechanisms
console.log('5. Error Recovery:');
if (fs.existsSync('./js/batch-upload.js')) {
    const batchUploadContent = fs.readFileSync('./js/batch-upload.js', 'utf8');
    
    if (/maxRetries/.test(batchUploadContent)) {
        console.log('   ✅ Retry mechanism present');
        validationResults.passed++;
    } else {
        console.log('   ❌ Retry mechanism missing');
        validationResults.failed++;
    }
    
    if (/catch/.test(batchUploadContent) && /error/.test(batchUploadContent)) {
        console.log('   ✅ Error handling present');
        validationResults.passed++;
    } else {
        console.log('   ❌ Error handling missing');
        validationResults.failed++;
    }
}
console.log('');

// 6. Backend Route Validation
console.log('6. Backend Route Implementation:');
if (fs.existsSync('./backend/routes/batch-documents.js')) {
    const routeContent = fs.readFileSync('./backend/routes/batch-documents.js', 'utf8');
    
    if (/router\.post\(['"]\/documents['"]/.test(routeContent)) {
        console.log('   ✅ POST /documents endpoint present');
        validationResults.passed++;
    } else {
        console.log('   ❌ POST /documents endpoint missing');
        validationResults.failed++;
    }
    
    if (/BEGIN/.test(routeContent) && /COMMIT/.test(routeContent) && /ROLLBACK/.test(routeContent)) {
        console.log('   ✅ Transaction handling present');
        validationResults.passed++;
    } else {
        console.log('   ❌ Transaction handling missing');
        validationResults.failed++;
    }
    
    if (/generateSafeId/.test(routeContent)) {
        console.log('   ✅ Safe ID generation in backend');
        validationResults.passed++;
    } else {
        console.log('   ❌ Safe ID generation missing in backend');
        validationResults.failed++;
    }
}
console.log('');

// Summary
console.log('Validation Summary:');
console.log('==================');
console.log(`✅ Passed: ${validationResults.passed}`);
console.log(`❌ Failed: ${validationResults.failed}`);
console.log(`⚠️  Warnings: ${validationResults.warnings}`);

const totalChecks = validationResults.passed + validationResults.failed;
const successRate = totalChecks > 0 ? (validationResults.passed / totalChecks * 100).toFixed(1) : 0;
console.log(`Success Rate: ${successRate}%`);

console.log('\nNext Steps:');
if (validationResults.failed === 0) {
    console.log('🎉 All validations passed! Ready for production deployment.');
    console.log('   1. Deploy to Render');
    console.log('   2. Run database migration');
    console.log('   3. Test batch upload functionality');
} else {
    console.log('🔧 Fix the failed validations before deployment:');
    if (validationResults.failed > 0) {
        console.log('   - Review failed checks above');
        console.log('   - Ensure all files are present and syntactically correct');
        console.log('   - Verify integration points are properly configured');
    }
}

process.exit(validationResults.failed > 0 ? 1 : 0);