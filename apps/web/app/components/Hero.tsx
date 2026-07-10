import { SearchWidget } from "./SearchWidget";

export function Hero() {
  return (
    <section className="bg-slate-50 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:px-14 lg:pt-24 lg:pb-24">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center text-center">
        <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-navy sm:text-5xl lg:text-h1 lg:leading-[1.08]">
          Your World, One Search Away
        </h1>
        <p className="mt-4 max-w-xl text-body-lg text-slate-500 sm:mt-5 lg:max-w-2xl">
          Seamlessly plan flights, hotels, tours, and study abroad programs in
          one unified interface.
        </p>

        <div className="mt-8 w-full max-w-3xl sm:mt-10 lg:w-fit lg:max-w-none">
          <SearchWidget />
        </div>
      </div>
    </section>
  );
}
