import ResourcePage from "./ResourcePage";

export default function Assets() {
  return (
    <ResourcePage
      title="Assets"
      createLabel="Add Asset"
      description="Operational equipment, condition, category and personnel assignment."
      endpoint="/api/assets"
      enableUpdate
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Asset" },
        { key: "category", label: "Category" },
        { key: "status", label: "Status", badge: true },
        { key: "location_name", label: "Location" },
        { key: "assigned_to_name", label: "Assigned" },
      ]}
      createFields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            "Aerial",
            "Communications",
            "Power",
            "Scientific",
            "Safety",
            "Logistics",
            "General",
          ],
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: ["Available", "Deployed", "Maintenance", "Unavailable"],
        },
        { name: "serial_number", label: "Serial number" },
      ]}
    />
  );
}
