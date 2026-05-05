#!/bin/bash
# Usage: ./compress_pdf.sh input.pdf [output.pdf]
# Output defaults to input_web.pdf

INPUT="${1}"
OUTPUT="${2:-${INPUT%.pdf}_web.pdf}"

if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 input.pdf [output.pdf]"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: file not found: $INPUT"
  exit 1
fi

echo "Compressing $INPUT → $OUTPUT ..."

gs \
  -sDEVICE=pdfwrite \
  -dCompatibilityLevel=1.5 \
  -dPDFSETTINGS=/printer \
  -dNOPAUSE -dQUIET -dBATCH \
  -dColorConversionStrategy=/LeaveColorUnchanged \
  -dColorImageResolution=200 \
  -dGrayImageResolution=200 \
  -dMonoImageResolution=300 \
  -sOutputFile="$OUTPUT" \
  "$INPUT"

echo "Done. $(du -h "$OUTPUT" | cut -f1)  $OUTPUT"
