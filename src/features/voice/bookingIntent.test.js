import { isBookingRequest } from "./bookingIntent";

test("recognizes natural booking requests", () => {
  expect(isBookingRequest("Arrange time with Joz")).toBe(true);
  expect(isBookingRequest("Schedule a meeting with Joz")).toBe(true);
  expect(isBookingRequest("Set up a call with Joz")).toBe(true);
});

test("does not treat ordinary time questions as booking requests", () => {
  expect(isBookingRequest("What's the time?")).toBe(false);
  expect(isBookingRequest("What time is it in Spain?")).toBe(false);
});
