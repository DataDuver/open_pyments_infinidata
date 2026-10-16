import { forwardRef } from "react";

const Card = forwardRef(function Card({ children, className = "" }, ref) {
  return (
    <div
      ref={ref}
      className={`min-w-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 ${className}`}
    >
      {children}
    </div>
  );
});

export default Card;
