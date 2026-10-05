export function countTicketsThatFit(ticketBounds, containerBottom, reservedSpace = 0) {
  const availableBottom = containerBottom - reservedSpace
  let visibleCount = 0

  for (const bounds of ticketBounds) {
    if (bounds.bottom > availableBottom) break
    visibleCount += 1
  }

  return visibleCount
}
