export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function encodeUtf16LeWithBom(text: string) {
  const buffer = new Uint8Array(text.length * 2 + 2)

  buffer[0] = 0xff
  buffer[1] = 0xfe

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)

    buffer[index * 2 + 2] = code & 0xff
    buffer[index * 2 + 3] = code >> 8
  }

  return buffer
}

export function downloadExcelFriendlyCsv(fileName: string, content: string) {
  const encodedContent = encodeUtf16LeWithBom(content)
  const blob = new Blob([encodedContent], {
    type: "text/csv;charset=utf-16le",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
