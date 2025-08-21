#!/bin/bash
echo "Testing Ghostscript with NFT Summons file..."

# Try different Ghostscript commands
echo -e "\n1. Standard extraction:"
gs -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -sOutputFile=test_gs1.pdf "7 NFT Summons Issued.pdf" 2>&1
echo "Result: $(pdfinfo test_gs1.pdf 2>/dev/null | grep Pages || echo 'Failed')"

echo -e "\n2. With error recovery:"
gs -q -dNOPAUSE -dBATCH -dPDFSTOPONERROR=false -sDEVICE=pdfwrite -sOutputFile=test_gs2.pdf "7 NFT Summons Issued.pdf" 2>&1
echo "Result: $(pdfinfo test_gs2.pdf 2>/dev/null | grep Pages || echo 'Failed')"

echo -e "\n3. Force all pages:"
gs -q -dNOPAUSE -dBATCH -dPDFSTOPONERROR=false -dFirstPage=1 -dLastPage=10 -sDEVICE=pdfwrite -sOutputFile=test_gs3.pdf "7 NFT Summons Issued.pdf" 2>&1
echo "Result: $(pdfinfo test_gs3.pdf 2>/dev/null | grep Pages || echo 'Failed')"

echo -e "\n4. With password removal:"
gs -q -dNOPAUSE -dBATCH -dPDFSTOPONERROR=false -dPrinted=false -sPDFPassword="" -sDEVICE=pdfwrite -sOutputFile=test_gs4.pdf "7 NFT Summons Issued.pdf" 2>&1
echo "Result: $(pdfinfo test_gs4.pdf 2>/dev/null | grep Pages || echo 'Failed')"

echo -e "\n5. Extract each page individually:"
for i in {1..5}; do
    gs -q -dNOPAUSE -dBATCH -dFirstPage=$i -dLastPage=$i -sDEVICE=pdfwrite -sOutputFile=test_page_$i.pdf "7 NFT Summons Issued.pdf" 2>&1
    if [ -f test_page_$i.pdf ]; then
        echo "Page $i: Extracted ($(stat -c%s test_page_$i.pdf) bytes)"
    else
        echo "Page $i: Failed"
    fi
done

# Clean up
rm -f test_gs*.pdf test_page_*.pdf
