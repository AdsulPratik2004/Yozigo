import type { SeatStatus } from "../lib/types";
import Seat, { Legend, type SeatState } from "./Seat";
import Screen from "./Screen";

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface Props {
  seatMap: Map<string, SeatStatus>;
  selectedSeats: string[];
  onToggleSeat: (seatLabel: string) => void;
  isHoldLocked?: boolean;
}

export default function SeatMap({
  seatMap,
  selectedSeats,
  onToggleSeat,
  isHoldLocked = false,
}: Props) {
  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* Curved Screen bar */}
      <Screen />

      {/* 8x10 Grid with responsive scrollable container */}
      <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
        <div className="mx-auto flex w-fit flex-col gap-2 sm:gap-2.5 px-2">
          {ROWS.map((row) => (
            <div key={row} className="flex items-center gap-1.5 sm:gap-3">
              {/* Left Row Label */}
              <span className="w-4 sm:w-5 text-center text-xs font-black text-muted flex-shrink-0">
                {row}
              </span>

              {/* Seat Buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                {NUMBERS.map((num) => {
                  const label = `${row}${num}`;
                  const seatInfo = seatMap.get(label);

                  const isBooked = seatInfo?.status === "booked";
                  const isHeldByOther = seatInfo?.status === "held" && !seatInfo.mine;
                  const isSelected = selectedSeats.includes(label);

                  let status: SeatState = "available";
                  if (isSelected) {
                    status = "selected";
                  } else if (isBooked) {
                    status = "booked";
                  } else if (isHeldByOther) {
                    status = "held";
                  }

                  return (
                    <Seat
                      key={label}
                      label={label}
                      status={status}
                      disabled={isHoldLocked && !isSelected}
                      onClick={() => onToggleSeat(label)}
                    />
                  );
                })}
              </div>

              {/* Right Row Label */}
              <span className="w-4 sm:w-5 text-center text-xs font-black text-muted flex-shrink-0">
                {row}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Seat State Legend */}
      <div className="mt-6 w-full max-w-lg">
        <Legend />
      </div>
    </div>
  );
}
