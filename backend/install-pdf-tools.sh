#!/bin/bash

# Install PDF processing tools for better handling of protected PDFs
echo "Installing PDF processing tools..."

# Check if we're on a Debian-based system
if command -v apt-get &> /dev/null; then
    echo "Installing qpdf and ghostscript..."
    apt-get update
    apt-get install -y qpdf ghostscript poppler-utils
    echo "✅ PDF tools installed"
else
    echo "Not a Debian-based system, skipping apt-get installs"
fi

# Check what's available
echo ""
echo "Checking available PDF tools:"
echo -n "qpdf: "
if command -v qpdf &> /dev/null; then
    qpdf --version 2>&1 | head -1
else
    echo "NOT FOUND"
fi

echo -n "ghostscript: "
if command -v gs &> /dev/null; then
    gs --version
else
    echo "NOT FOUND"
fi

echo -n "pdftk: "
if command -v pdftk &> /dev/null; then
    pdftk --version 2>&1 | head -1
else
    echo "NOT FOUND"
fi

echo -n "pdfinfo: "
if command -v pdfinfo &> /dev/null; then
    echo "FOUND"
else
    echo "NOT FOUND"
fi