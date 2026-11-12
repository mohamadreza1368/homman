import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HeartLessonQuiz } from "./HeartLessonQuiz";

afterEach(cleanup);
it("gives feedback and scores each answer only once", () => {
  const onComplete = vi.fn();
  render(<HeartLessonQuiz fa onClose={vi.fn()} onComplete={onComplete} />);
  fireEvent.click(screen.getByLabelText("دهلیز چپ"));
  fireEvent.click(screen.getByRole("button", { name: "بررسی پاسخ" }));
  expect(screen.getByRole("status").textContent).toContain("این پاسخ درست نیست");
  fireEvent.click(screen.getByRole("button", { name: "پرسش بعدی" }));
  fireEvent.click(screen.getByLabelText("بطن راست"));
  fireEvent.click(screen.getByRole("button", { name: "بررسی پاسخ" }));
  fireEvent.click(screen.getByRole("button", { name: "پرسش بعدی" }));
  fireEvent.click(screen.getByLabelText("دهلیز چپ"));
  fireEvent.click(screen.getByRole("button", { name: "بررسی پاسخ" }));
  fireEvent.click(screen.getByRole("button", { name: "پرسش بعدی" }));
  fireEvent.click(screen.getByLabelText("آئورت"));
  fireEvent.click(screen.getByRole("button", { name: "بررسی پاسخ" }));
  fireEvent.click(screen.getByRole("button", { name: "مشاهدهٔ نتیجه" }));
  expect(screen.getByRole("status").textContent).toContain("3 پاسخ درست از 4");
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onComplete).toHaveBeenCalledWith(3);
  fireEvent.click(screen.getByRole("button", { name: "تکرار آزمون" }));
  expect(screen.getByText("پرسش 1 از 4")).toBeTruthy();
});
