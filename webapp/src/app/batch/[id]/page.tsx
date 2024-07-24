import BatchInfo from "../../../components/BatchInfo";
import { getPlaceholderImageUrl } from "../../../utils/placeholderImage";

enum Mode {
    Buy = "buy",
    Redeem = "redeem",
    View = "view",
}

export default function Page({ params }: { params: { id: string, mode: Mode } }) {
    if (typeof params.id !== "string") {
        return <p>Loading...</p>;
    }

    const batchID = BigInt(params.id);
    const placeholderImage = getPlaceholderImageUrl(params.id);

    return (
        <div className="container mx-auto p-4">
            <div className="bg-white rounded-lg shadow-md p-4">
                <img
                    src={placeholderImage}
        <div>
                    {(() => {
                        switch (params.mode) {
                            case Mode.Buy:
                                return <p>Buy mode</p>;
                            case Mode.Redeem:
                                return <p>Redeem mode</p>;
                            case Mode.View:
                                return <p>View mode</p>;
                            default:
                                return null;
                        }
                    })()}
                    <BatchInfo batchID={batchID} />
                </div>
                );
}
